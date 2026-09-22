/** IPM-facing boundary: person-days and source calendar, never a fixed hours/month conversion. */
export interface ResourceWorklog {
  id: string; date: string; person: string; primaryDepartment: string; secondaryDepartment: string
  personDays: number; monthWorkingDays: number; description: string
}
export interface ResourceActualExpense {
  id: string; date: string; primaryDepartment: string; secondaryDepartment: string; subject: string; amountYuan: number; description: string
}
export interface ResourceAccountingDataset {
  projectId: string; source: 'mock'; startDate: string; endDate: string
  worklogs: ResourceWorklog[]; expenses: ResourceActualExpense[]
}
