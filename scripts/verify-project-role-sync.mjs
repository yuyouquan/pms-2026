#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = relativePath => {
  const file = path.join(root, relativePath)
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
}
const requireContract = (file, pattern, message) => assert.match(read(file), pattern, message)

const roles = 'src/lib/projectRoleSync.ts'
for (const role of ['技术项目负责人', '技术项目经理', '测试代表', '质量代表', '产品代表', '标准化代表']) {
  requireContract(roles, new RegExp(`['"]${role}['"]`), `Technical-team fixed role ${role} must participate in one-way permission-member sync.`)
}
requireContract(roles, /syncTechnicalTeamToPermissionMembers\b/, 'Technical teams must synchronize their six fixed roles into permission members.')
requireContract(roles, /permissionMembersReadOnly\s*:\s*true/, 'Technical-project permission members must be read-only.')
requireContract(roles, /syncTosTeamAndPermissionMembers\b/, 'tOS team and permission-member editing must share a dedicated synchronization entry point.')
requireContract(roles, /lastWriteWins\b/, 'tOS team and permission-member synchronization must use last-write-wins conflict resolution.')
assert.doesNotMatch(read(roles), /syncTechnicalProjectRolesToTos\b/, 'Technical-team synchronization must not write into tOS teams.')

console.log('project role sync contract passed')
