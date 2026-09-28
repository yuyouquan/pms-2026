export interface ProjectTeamMember {
  employeeId: string
  name: string
  department: string
  email: string
  roles: readonly string[]
  valueDelivery: string
}

export interface ProjectTeamSnapshot {
  projectId: string
  source: 'IPM Mock'
  roles: readonly string[]
  members: readonly ProjectTeamMember[]
}

export interface ProjectTeamProjectRef {
  id: string
  parentProjectId?: string | null
  sourceBid?: string
  nameInferredSourceBid?: string
  projectAttribute?: string
  mockTeamSourceId?: string | null
}
