/** 科目名称保存在版本中，配置项变更或删除不会改写已有预算。 */
export interface NonLaborInvestmentItem {
  id: string
  secondaryDepartment: string
  tertiaryDepartment: string
  subjectId: string
  secondarySubject: string
  tertiarySubject: string
  /** 费用金额，单位：元。 */
  monthlyAmounts: Record<string, number>
}

export interface NonLaborInvestment {
  startMonth: string | null
  endMonth: string | null
  items: NonLaborInvestmentItem[]
}
