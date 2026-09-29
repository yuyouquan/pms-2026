export interface ProjectTeamMember {
  employeeId: string
  name: string
  department: string
  email: string
  roles: readonly string[]
  roleCodes?: readonly string[]
  valueDelivery: string
}

export interface ProjectTeamSnapshot {
  projectId: string
  source: 'IPM Mock'
  sourceBinding?: string
  roleDefinitions?: readonly { code: string; name: string }[]
  roles: readonly string[]
  members: readonly ProjectTeamMember[]
}

export interface ProjectTeamProjectRef {
  id: string
  type?: string
  parentProjectId?: string | null
  sourceBid?: string
  nameInferredSourceBid?: string
  projectAttribute?: string
  mockTeamSourceId?: string | null
}
