import type { ProjectTeamMember, ProjectTeamSnapshot } from '@/types/projectTeam'

// Independent IPM-shaped fixture. Login names resolve to stable employee IDs; role codes resolve to independent PMS project copies.
export const MOCK_LOGIN_EMPLOYEE_IDS: Readonly<Record<string, string>> = {
  '演示用户10': 'DEMO-E010',
  '演示用户11': 'DEMO-E011',
}

const members: readonly ProjectTeamMember[] = [
  { employeeId: 'DEMO-E010', name: '演示用户10', department: '示例研发部', email: 'demo10@example.com', roles: ['SPM', '研发代表'], roleCodes: ['RJPM', 'RD'], valueDelivery: '项目交付' },
  { employeeId: 'DEMO-E011', name: '演示用户11', department: '示例测试部', email: 'demo11@example.com', roles: ['测试代表'], roleCodes: ['QA'], valueDelivery: '测试验证' },
  // Same display name as E010, but this employee has no login mapping.
  { employeeId: 'DEMO-E110', name: '演示用户10', department: '示例测试部', email: 'demo110@example.com', roles: ['测试代表'], roleCodes: ['QA'], valueDelivery: '测试验证' },
]

export const MOCK_LEGACY_IPM_TEAMS_BY_PROJECT_ID: Readonly<Record<string, ProjectTeamSnapshot>> = {
  '1': { projectId: '1', source: 'IPM Mock', roles: ['SPM', '研发代表', '测试代表', '未映射代表'], roleDefinitions: [{ code: 'RJPM', name: 'SPM' }, { code: 'RD', name: '研发代表' }, { code: 'QA', name: '测试代表' }, { code: 'UNMAPPED', name: '未映射代表' }], members: [members[0]] },
  '2': { projectId: '2', source: 'IPM Mock', roles: ['测试代表'], roleDefinitions: [{ code: 'QA', name: '测试代表' }], members: [members[1], members[2]] },
  '5': { projectId: '5', source: 'IPM Mock', roles: ['研发代表', '空角色'], roleDefinitions: [{ code: 'RD', name: '研发代表' }, { code: 'EMPTY', name: '空角色' }], members: [members[0]] },
  '9': { projectId: '9', source: 'IPM Mock', roles: ['研发代表'], roleDefinitions: [{ code: 'RD', name: '研发代表' }], members: [members[0]] },
}

export const MOCK_IPM_TEAMS_BY_BID: Readonly<Record<string, ProjectTeamSnapshot>> = {
  'EXT-001': { projectId: 'EXT-001', source: 'IPM Mock', roles: ['SPM', '研发代表'], roleDefinitions: [{ code: 'RJPM', name: 'SPM' }, { code: 'RD', name: '研发代表' }], members: [members[0]] },
  'EXT-006': { projectId: 'EXT-006', source: 'IPM Mock', roles: ['SPM', '研发代表'], roleDefinitions: [{ code: 'RJPM', name: 'SPM' }, { code: 'RD', name: '研发代表' }], members: [members[0]] },
}
