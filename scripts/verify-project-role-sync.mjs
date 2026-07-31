#!/usr/bin/env node
import assert from 'node:assert/strict'
import { hasCallExpression, projectRoot, readSource, requireSource } from './lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
const roles = ['技术项目负责人', '技术项目经理', '测试代表', '质量代表', '产品代表', '标准化代表']
for (const role of roles) requireSource(root, 'src/stores/permission.ts', new RegExp(`['"]${role}['"]`), `missing fixed technical role ${role}`)
requireSource(root, 'src/stores/permission.ts', /TECHNICAL_TEAM_PERMISSION_MAPPING\b/, 'missing fixed-role mapping')
requireSource(root, 'src/stores/project.ts', /syncTechnicalTeamPermissionMembers\b/, 'missing technical one-way action')
requireSource(root, 'src/stores/project.ts', /syncTosTeamPermissionMembers\b/, 'missing shared tOS action')
requireSource(root, 'src/stores/project.ts', /syncTosTeamPermissionMembers[\s\S]*?responsiblePersons/, 'version manager sync must update responsible persons')
requireSource(root, 'src/stores/project.ts', /lastSavedAt|updatedAt/, 'shared tOS action must retain last-save ordering')
const modal = readSource(root, 'src/components/project-info/ProjectInfoModal.tsx')
const permission = readSource(root, 'src/components/permission/PermissionModule.tsx')
assert.equal(hasCallExpression(modal, 'syncTechnicalTeamPermissionMembers'), true, 'team save calls technical one-way action')
assert.equal(hasCallExpression(modal, 'syncTosTeamPermissionMembers'), true, 'team save calls shared tOS action')
assert.equal(hasCallExpression(permission, 'syncTosTeamPermissionMembers'), true, 'permission-member save calls the same shared tOS action')
console.log('project role sync contract passed')
