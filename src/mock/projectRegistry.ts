import type { ProjectItem } from '@/types/app'

/** Fresh-origin scenarios only. Existing persisted registries are never backfilled with these rows. */
export const RESOURCE_FORMAL_IDS = { machine: '1', tos: '2', technical: '4', capability: '5' } as const
export const RESOURCE_BUDGET_IDS = { machine: 'mock-budget-machine-bound', tos: 'mock-budget-tos-bound', technical: 'mock-budget-technical-bound', capability: 'mock-budget-capability-bound' } as const
const types = { machine: '整机产品项目', tos: 'tOS版本项目', technical: '技术项目', capability: '能力建设项目' } as const
const labels = { machine: '整机', tos: 'tOS', technical: '技术', capability: '能力建设' } as const

function project(id: string, name: string, type: ProjectItem['type'], attribute: 'formal' | 'budget' | 'roadmap', owner = '演示用户01'): ProjectItem {
  return {
    id, name, type, projectAttribute: attribute, boundFormalProjectId: null,
    createdBy: owner, createdAt: '2026-08-30T01:00:00.000Z', updatedAt: '2026-08-30T01:00:00.000Z',
    responsiblePersons: [owner], leader: owner, spm: type === types.machine ? owner : '',
    status: type === types.machine ? '待立项' : type === types.technical ? '进行中' : '在研',
    progress: 0, healthStatus: 'normal', markets: [], androidVersion: '', chipPlatform: '', tosVersion: '', planStartDate: '', planEndDate: '', developCycle: 0,
    brand: '', productLine: '', marketName: '',
    fieldValues: type === types.machine ? { machineSpm: [owner], fanTrialEnabled: '否' } : type === types.tos ? { tosVersionProjectManager: [owner] }
      : type === types.technical ? { technicalLead: [owner] } : {},
  }
}

export const RESOURCE_REGISTRY_PROJECTS: ProjectItem[] = [
  ...([false, true] as const).map(multiple => ({
    ...project(`mock-budget-fan-trial-${multiple ? 'multiple' : 'single'}`, `示例整机-粉丝试用${multiple ? '多国' : '单国'}`, types.machine, 'budget'),
    projectCode: `DEMOB-FAN-${multiple ? 'MULTIPLE' : 'SINGLE'}`,
    projectDescription: '粉丝试用国家与台数示例；进入空间扩展信息可查看、编辑。',
    fieldValues: { machineSpm: ['演示用户01'], fanTrialEnabled: '是', fanTrialCountries: multiple
      ? [{ country: '尼日利亚', quantity: 30 }, { country: '肯尼亚', quantity: 20 }, { country: '印度', quantity: 15 }]
      : [{ country: '尼日利亚', quantity: 20 }] },
  })),
  ...([false, true] as const).map(complete => ({
    ...project(`mock-budget-technical-info-${complete ? 'complete' : 'pending'}`, `示例技术-基础信息${complete ? '已完整' : '待补一项'}`, types.technical, 'budget'),
    projectCode: `DEMOB-INFO-${complete ? 'COMPLETE' : 'PENDING'}`,
    projectDescription: complete ? '必填资料已完整，不生成基础信息待办。' : '仅缺项目价值；预算项目不生成基础信息待办，可进入空间主动补充。',
    fieldValues: { technicalLead: ['演示用户01'], technicalProjectManager: '演示用户02',
      tmg: '示例应用领域', subdomain: '示例智能技术', projectYear: '2026', projectValue: complete ? '人无我有' : '' },
  })),
  ...Object.entries(RESOURCE_FORMAL_IDS).map(([key, formalId]) => {
    const category = key as keyof typeof types
    return { ...project(RESOURCE_BUDGET_IDS[category], `示例${labels[category]}-关联年度预算`, types[category], 'budget', category === 'machine' ? '演示用户09' : '演示用户01'),
      projectCode: `DEMOB-${category.toUpperCase()}`, boundFormalProjectId: formalId,
      projectDescription: '年度预算来源项目。保留两版手工里程碑，正式空间只读关联，汇总仅计算一次。' }
  }),
  ...(['tos', 'technical', 'capability'] as const).map(category => ({
    ...project(`mock-budget-${category}-unbound`, `示例${labels[category]}-独立跨年预算`, types[category], 'budget'),
    projectCode: `DEMOB-${category.toUpperCase()}-FREE`, projectDescription: '未绑定正式项目；两版跨年年度预算与手工里程碑。',
    ...(category === 'technical' ? { responsiblePersons: ['演示用户01', '演示用户02'], technicalLead: '演示用户01、演示用户02', fieldValues: { technicalLead: ['演示用户01', '演示用户02'] },
      projectDescription: '多责任人共同管理的独立技术预算；两版跨年年度预算与手工里程碑。' } : {}),
    ...(category === 'tos' ? { projectDescription: '独立跨年预算；最新版本的维护结束时间待补充，历史版本保留完整里程碑。' } : {}),
  })),
  { ...project('mock-budget-machine-unbound', '示例整机-独立跨年预算', types.machine, 'budget'), projectCode: 'DEMOB-MACHINE-FREE',
    brand: '示例品牌A', productLine: '示例系列A', marketName: '示例独立市场', projectDescription: '未绑定正式项目；可维护品牌、产品线、市场名与跨年里程碑。' },
  { ...project('mock-budget-machine-cancelled', '示例整机-已取消预算', types.machine, 'budget'), projectCode: 'DEMOB-MACHINE-CANCELLED',
    brand: '示例品牌B', productLine: '示例系列B', marketName: '示例保留市场', projectDescription: '人力项目已取消，历史年度预算保留可查看，不能新建版本。' },
  { ...project('mock-budget-machine-incomplete-bound', '示例整机-来源资料待完善预算', types.machine, 'budget'), projectCode: 'DEMOB-MACHINE-PENDING',
    boundFormalProjectId: 'mock-formal-machine-incomplete', projectDescription: '绑定来源缺少品牌、产品线、市场名；显示只读空值及提示，仍可新建年度预算。' },
  { ...project('mock-budget-machine-incomplete-unbound', '示例整机-待填写资料预算', types.machine, 'budget'), projectCode: 'DEMOB-MACHINE-EMPTY',
    projectDescription: '尚未绑定且资料为空；新建年度预算时须填写品牌、产品线、市场名。当前无版本。' },
  { ...project('mock-roadmap-incomplete', '示例整机-路标待补日期', types.machine, 'roadmap'), projectCode: 'DEMOR-PENDING',
    boundFormalProjectId: '1', firstSaleTosVersionId: '17.2', androidVersion: 'Android 17',
    secondaryCategory: '整机-手机', productType: '新品', brand: '示例品牌A', productLine: '示例系列F', productSeries: '路标演示系列', marketName: '路标演示市场',
    startRam: '8GB', versionType: 'Full', developMode: '自研',
    fieldValues: { machineSpm: ['演示用户01'], fanTrialEnabled: '否', chipCode: '示例路标芯片', chipModel: '示例路标芯片型号', chipPlatform: '示例芯片平台' },
    projectDescription: '资料未齐的路标项目保留表格展示，补充日期后进入演进图；资源保持空状态。' },
  { ...project('mock-formal-machine-incomplete', '示例整机-资料待完善', types.machine, 'formal', '演示用户02'),
    sourceBid: 'EXT-014', secondaryCategory: '整机-手机', projectCode: '', projectDescription: '已建档的正式整机来源，品牌、产品线、市场名与一级计划待补充。' },
]
