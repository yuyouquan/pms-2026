import { RESOURCE_FORMAL_IDS } from '@/mock/projectRegistry'
import type { ResourceAccountingDataset, ResourceActualExpense } from '@/types/resourceAccounting'
import { dashboardDates, dashboardMonthDates, isDashboardWorkday } from '@/components/project-resources/resourceDashboardPeriods'

type Category = keyof typeof RESOURCE_FORMAL_IDS
type Department = 'product' | 'software' | 'hardware'
const departments = {
  product: { primaryDepartment: '研发中心', secondaryDepartment: '产品部' },
  software: { primaryDepartment: '研发中心', secondaryDepartment: '软件部' },
  hardware: { primaryDepartment: '硬件部', secondaryDepartment: '结构部' },
}
const profiles: Record<Category, {
  label: string; people: { department: Department; capacity: number; description: string }[]
  monthlyLoad: number[]; expenses: (Omit<ResourceActualExpense, 'id' | 'primaryDepartment' | 'secondaryDepartment'> & { department: Department })[]
}> = {
  machine: {
    label: '整机',
    people: [
      { department: 'product', capacity: .55, description: '产品需求与整机方案评审' },
      { department: 'software', capacity: .9, description: '整机适配与驱动联调' },
      { department: 'software', capacity: .85, description: '系统集成与稳定性验证' },
      { department: 'hardware', capacity: 1, description: '结构设计与样机试制' },
      { department: 'hardware', capacity: .95, description: '可靠性验证与问题闭环' },
      { department: 'hardware', capacity: .8, description: '试产支持与工艺确认' },
    ],
    monthlyLoad: [.35, .5, .72, .9, 1, .92, .78, .6, .42, .3, .24, .2, .18, .16, .12],
    expenses: [
      { date: '2026-02-09', department: 'hardware', subject: '材料费 / 样件', amountYuan: 68000, description: '首轮结构样机' },
      { date: '2026-05-18', department: 'hardware', subject: '设备费 / 测试设备', amountYuan: 92000, description: '可靠性实验与治具' },
      { date: '2026-08-20', department: 'software', subject: '设备费 / 测试设备', amountYuan: 24000, description: '整机自动化回归设备' },
      { date: '2026-12-16', department: 'product', subject: '差旅费 / 交通', amountYuan: 12800, description: '上市后项目复盘' },
    ],
  },
  tos: {
    label: 'tOS',
    people: [
      { department: 'product', capacity: .5, description: '版本需求梳理与体验走查' },
      { department: 'software', capacity: 1, description: '系统框架与核心功能开发' },
      { department: 'software', capacity: .9, description: '应用功能与版本联调' },
      { department: 'software', capacity: .85, description: '性能优化与兼容性验证' },
      { department: 'software', capacity: .75, description: '版本回归与发布准备' },
    ],
    monthlyLoad: [.3, .38, .5, .64, .8, .95, 1, .94, .82, .7, .55, .42, .34, .28, .2],
    expenses: [
      { date: '2026-03-12', department: 'software', subject: '设备费 / 测试设备', amountYuan: 32000, description: '多机型兼容性测试设备' },
      { date: '2026-07-08', department: 'software', subject: '其他费用 / 工具服务', amountYuan: 18500, description: '版本自动化验证服务' },
      { date: '2026-09-16', department: 'product', subject: '差旅费 / 交通', amountYuan: 8600, description: '版本体验评审' },
      { date: '2027-01-06', department: 'software', subject: '设备费 / 测试设备', amountYuan: 14000, description: '维护版本设备扩充' },
    ],
  },
  technical: {
    label: '技术',
    people: [
      { department: 'product', capacity: .45, description: '技术场景定义与成果评审' },
      { department: 'software', capacity: .8, description: '技术原型开发与实验分析' },
      { department: 'hardware', capacity: .9, description: '实验验证与样件测试' },
    ],
    monthlyLoad: [.55, .8, 1, .9, .74, .58, .45, .36, .28, .22, .18, .15, .12, .1, .08],
    expenses: [
      { date: '2026-02-24', department: 'hardware', subject: '材料费 / 样件', amountYuan: 41000, description: '原型实验样件' },
      { date: '2026-04-15', department: 'hardware', subject: '设备费 / 测试设备', amountYuan: 27000, description: '性能验证仪器' },
      { date: '2026-08-12', department: 'software', subject: '其他费用 / 工具服务', amountYuan: 9600, description: '成果评估与分析工具' },
    ],
  },
  capability: {
    label: '能力建设',
    people: [
      { department: 'product', capacity: .25, description: '流程梳理与能力验收' },
      { department: 'software', capacity: .7, description: '平台工具建设与推广支持' },
    ],
    monthlyLoad: [.22, .3, .4, .52, .68, .84, 1, .88, .72, .58, .48, .38, .3, .26, .2],
    expenses: [
      { date: '2026-04-22', department: 'software', subject: '其他费用 / 工具服务', amountYuan: 14500, description: '平台环境与工具试用' },
      { date: '2026-07-15', department: 'product', subject: '培训费 / 课程', amountYuan: 6500, description: '内部能力推广培训' },
      { date: '2026-09-23', department: 'software', subject: '设备费 / 测试设备', amountYuan: 4800, description: '平台验收设备' },
    ],
  },
}

/** Deterministic shared ledger fixtures: no browser-storage reset and no derivation from budgets. */
const datasets: ResourceAccountingDataset[] = (Object.entries(RESOURCE_FORMAL_IDS) as [Category, string][]).map(([category, projectId], projectIndex) => {
  const startDate = '2026-01-01', endDate = '2027-03-31', profile = profiles[category]
  const worklogs = dashboardDates(startDate, endDate).filter(isDashboardWorkday).flatMap((date, dayIndex) => profile.people.flatMap((person, personIndex) => {
    if ((dayIndex + personIndex * 3 + projectIndex) % 11 === 0) return []
    const monthIndex = (Number(date.slice(0, 4)) - 2026) * 12 + Number(date.slice(5, 7)) - 1
    const dailyLoad = [1, .9, .85, 1, .95][(dayIndex + personIndex) % 5]
    const personDays = Math.round(person.capacity * profile.monthlyLoad[monthIndex] * dailyLoad * 100) / 100
    return [{ ...departments[person.department], id: `mock-ipm-${projectId}-${date}-${personIndex}`, date,
      person: `演示${profile.label}成员${String(personIndex + 1).padStart(2, '0')}`, description: person.description, personDays,
      monthWorkingDays: dashboardMonthDates(date.slice(0, 7)).filter(isDashboardWorkday).length }]
  }))
  const expenses = profile.expenses.map(({ department, ...expense }, index) => ({ ...expense, ...departments[department], id: `mock-actual-expense-${projectId}-${index}` }))
  return { projectId, source: 'mock', startDate, endDate, worklogs, expenses }
})
export function resourceAccountingDataset(projectId: string) { return datasets.find(dataset => dataset.projectId === projectId) }
