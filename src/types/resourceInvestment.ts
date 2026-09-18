export interface DepartmentInvestmentRow {
  id: string
  primaryDepartment: string
  secondaryDepartment: string
  estimatedInvestment: number
  [key: string]: string | number
}
