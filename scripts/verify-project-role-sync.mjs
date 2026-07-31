#!/usr/bin/env node
import { projectRoot, requireSource } from './lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
const roles = ['技术项目负责人', '技术项目经理', '测试代表', '质量代表', '产品代表', '标准化代表']
for (const role of roles) requireSource(root, 'src/stores/permission.ts', new RegExp(`['"]${role}['"]`), `missing fixed technical role ${role}`)
requireSource(root, 'src/stores/permission.ts', /TECHNICAL_TEAM_PERMISSION_MAPPING\b/, 'missing fixed-role to permission-member mapping')
requireSource(root, 'src/stores/project.ts', /syncTechnicalTeamPermissionMembers\b/, 'missing one-way technical team permission sync action')
requireSource(root, 'src/stores/project.ts', /syncTosTeamPermissionMembers\b/, 'missing shared tOS team and permission-member action')
requireSource(root, 'src/components/permission/PermissionModule.tsx', /readOnly.*technical|technical.*readOnly/i, 'technical permission members must render read-only')
requireSource(root, 'src/components/project-info/ProjectInfoModal.tsx', /syncTechnicalTeamPermissionMembers\b/, 'technical team editor must call the one-way sync action')
requireSource(root, 'src/components/project-info/ProjectInfoModal.tsx', /syncTosTeamPermissionMembers\b/, 'tOS team editor must call the shared sync action')
console.log('project role sync contract passed')
