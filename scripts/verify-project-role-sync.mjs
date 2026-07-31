#!/usr/bin/env node
import assert from 'node:assert/strict'
import { hasCallExpression, loadTypeScriptModule, projectRoot, readSource, requireSource } from './lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
const roles = ['技术项目负责人', '技术项目经理', '测试代表', '质量代表', '产品代表', '标准化代表']
for (const role of roles) requireSource(root, 'src/stores/permission.ts', new RegExp(`['"]${role}['"]`), `missing fixed technical role ${role}`)
requireSource(root, 'src/stores/permission.ts', /TECHNICAL_TEAM_PERMISSION_MAPPING\b/, 'missing fixed-role mapping')
requireSource(root, 'src/stores/project.ts', /syncTechnicalTeamPermissionMembers\b/, 'missing technical one-way action')
requireSource(root, 'src/stores/project.ts', /syncTosTeamPermissionMembers\b/, 'missing shared tOS action')
const modal = readSource(root, 'src/components/project-info/ProjectInfoModal.tsx')
const permission = readSource(root, 'src/components/permission/PermissionModule.tsx')
assert.equal(hasCallExpression(modal, 'syncTechnicalTeamPermissionMembers'), true, 'team save calls technical one-way action')
assert.equal(hasCallExpression(modal, 'syncTosTeamPermissionMembers'), true, 'team save calls shared tOS action')
assert.equal(hasCallExpression(permission, 'syncTosTeamPermissionMembers'), true, 'permission-member save calls the same shared tOS action')
const projectStore = loadTypeScriptModule(root, 'src/stores/project.ts')
assert.equal(typeof projectStore.synchronizeTechnicalRoleMembers, 'function', 'missing executable technical synchronization rule')
const initialTechnicalRoles = { 技术项目负责人: ['旧负责人'], 技术项目经理: ['旧经理'], 测试代表: ['旧测试'], 质量代表: ['旧质量'], 产品代表: ['旧产品'], 标准化代表: ['旧标准'], 自定义角色: ['保留成员'] }
const synchronizedTechnicalRoles = projectStore.synchronizeTechnicalRoleMembers(initialTechnicalRoles, { 技术项目负责人: ['新负责人'], 技术项目经理: [], 测试代表: ['新测试'], 质量代表: [], 产品代表: ['新产品'], 标准化代表: [] })
assert.deepEqual(synchronizedTechnicalRoles, { 技术项目负责人: ['新负责人'], 技术项目经理: [], 测试代表: ['新测试'], 质量代表: [], 产品代表: ['新产品'], 标准化代表: [], 自定义角色: ['保留成员'] }, 'technical sync overwrites all six fixed roles, clears empty members, and preserves custom roles')
assert.equal(typeof projectStore.synchronizeTosRoleMembers, 'function', 'missing executable shared tOS synchronization rule')
let state = projectStore.synchronizeTosRoleMembers({}, { source: 'team', members: ['A'], role: '版本项目经理' })
state = projectStore.synchronizeTosRoleMembers(state, { source: 'permission', members: ['B'], role: '版本项目经理' })
assert.deepEqual(state, { teamMembers: ['B'], permissionMembers: ['B'], responsiblePersons: ['B'] }, 'permission save wins after team save')
state = projectStore.synchronizeTosRoleMembers({}, { source: 'permission', members: ['B'], role: '版本项目经理' })
state = projectStore.synchronizeTosRoleMembers(state, { source: 'team', members: ['A'], role: '版本项目经理' })
assert.deepEqual(state, { teamMembers: ['A'], permissionMembers: ['A'], responsiblePersons: ['A'] }, 'team save wins after permission save')
console.log('project role sync contract passed')
