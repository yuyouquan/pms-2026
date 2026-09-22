import { RESOURCE_FORMAL_IDS } from '@/mock/projectRegistry'
import type { ResourceAccountingDataset } from '@/types/resourceAccounting'
import { dashboardDates, dashboardMonthDates, isDashboardWorkday } from '@/components/project-resources/resourceDashboardPeriods'

/** Independent ledger fixtures. Budget/version edits must never regenerate actuals from planned totals. */
const datasets: ResourceAccountingDataset[] = Object.values(RESOURCE_FORMAL_IDS).map((projectId, projectIndex) => {
  const startDate = '2026-01-01', endDate = '2027-03-31'
  const people = [
    { person: '演示成员甲', primaryDepartment: '研发中心', secondaryDepartment: '产品部', personDays: 0.75, description: '需求梳理与产品方案' },
    { person: '演示成员乙', primaryDepartment: '研发中心', secondaryDepartment: '软件部', personDays: 1, description: '功能开发与联调' },
    { person: '演示成员丙', primaryDepartment: '硬件部', secondaryDepartment: '结构部', personDays: 0.5, description: '结构设计与验证' },
  ]
  const worklogs = dashboardDates(startDate, endDate).filter(isDashboardWorkday).flatMap((date, dayIndex) => people
    .filter((_, personIndex) => (dayIndex + personIndex + projectIndex) % 7 !== 0)
    .map((person, index) => ({ ...person, id: `mock-ipm-${projectId}-${date}-${index}`, date,
      monthWorkingDays: dashboardMonthDates(date.slice(0, 7)).filter(isDashboardWorkday).length })))
  const expenses = [
    { date: '2026-02-09', primaryDepartment: '研发中心', secondaryDepartment: '软件部', subject: '设备费 / 测试设备', amountYuan: 18000, description: '联调设备费用' },
    { date: '2026-06-18', primaryDepartment: '硬件部', secondaryDepartment: '结构部', subject: '材料费 / 样件', amountYuan: 12500, description: '结构验证样件' },
    { date: '2026-12-29', primaryDepartment: '研发中心', secondaryDepartment: '产品部', subject: '差旅费 / 交通', amountYuan: 6800, description: '项目评审差旅' },
    { date: '2027-01-06', primaryDepartment: '研发中心', secondaryDepartment: '软件部', subject: '设备费 / 测试设备', amountYuan: 9600, description: '测试设备扩充' },
  ].map((expense, index) => ({ ...expense, id: `mock-actual-expense-${projectId}-${index}`, amountYuan: expense.amountYuan + projectIndex * 1000 }))
  return { projectId, source: 'mock', startDate, endDate, worklogs, expenses }
})
export function resourceAccountingDataset(projectId: string) { return datasets.find(dataset => dataset.projectId === projectId) }
