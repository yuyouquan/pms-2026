import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const permissionModuleFile = path.join(root, 'src/components/permission/PermissionModule.tsx')
const permissionConstantsFile = path.join(root, 'src/constants/permissions.ts')
const permissionStoreFile = path.join(root, 'src/stores/permission.ts')

const expectedPerms = [
  'roadmap:view',
  'roadmap:edit',
  'roadmap:baseline',
  'roadmap:share',
  'roadmap:export',
  'configCenter:planEdit',
  'configCenter:planPublish',
  'configCenter:transferEdit',
  'configCenter:enumEdit',
  'permissionCenter:manageRoles',
]

const expectedByRole = {
  '管理组': expectedPerms,
  '编辑组': ['roadmap:view', 'roadmap:edit', 'roadmap:baseline'],
  '查看组': ['roadmap:view'],
}

function fail(message) {
  console.error(message)
  process.exit(1)
}

function assertIncludes(source, text, label) {
  if (!source.includes(text)) fail(`${label} is missing ${text}`)
}

if (!fs.existsSync(permissionModuleFile)) fail('Missing PermissionModule.tsx')
if (!fs.existsSync(permissionConstantsFile)) fail('Missing permissions.ts')
if (!fs.existsSync(permissionStoreFile)) fail('Missing permission.ts')

const moduleSource = fs.readFileSync(permissionModuleFile, 'utf8')
const constantsSource = fs.readFileSync(permissionConstantsFile, 'utf8')
const storeSource = fs.readFileSync(permissionStoreFile, 'utf8')

for (const perm of expectedPerms) {
  assertIncludes(constantsSource, perm, 'GLOBAL_PERM_OPTIONS')
  assertIncludes(storeSource, `'${perm}': true`, 'default globalRolePerms')
}

for (const [role, enabledPerms] of Object.entries(expectedByRole)) {
  const roleIndex = storeSource.indexOf(`'${role}': {`)
  if (roleIndex === -1) fail(`Missing globalRolePerms for ${role}`)
  const nextRoleIndex = storeSource.indexOf('\n    ', roleIndex + role.length + 6)
  const roleBlock = storeSource.slice(roleIndex, nextRoleIndex === -1 ? undefined : nextRoleIndex)
  for (const perm of expectedPerms) {
    const shouldEnable = enabledPerms.includes(perm)
    const expectedText = `'${perm}': ${shouldEnable ? 'true' : 'false'}`
    assertIncludes(roleBlock, expectedText, `${role} permission matrix`)
  }
}

for (const role of ['管理组', '编辑组', '查看组']) {
  assertIncludes(storeSource, `name: '${role}'`, 'global permission roles')
}

for (const label of ['项目路标', '配置中心', '计划编辑', '计划发布', '转维编辑', '权限中心', '对角色进行新增、修改、删除、成员添加']) {
  assertIncludes(constantsSource, label, 'global permission table')
}

assertIncludes(constantsSource, "module: '配置中心'", 'config center permission module')
assertIncludes(
  constantsSource,
  "{ key: 'configCenter:enumEdit', name: '枚举值新增、修改、删除' }",
  'enum configuration edit permission',
)

for (const bypassText of [
  "if (userRoles.some(role => role.name === '管理组')) return true",
  "if (isGlobalAdmin(userName)) return true",
]) {
  assertIncludes(storeSource, bypassText, 'global administrator bypass')
}

for (const text of [
  '角色权限配置',
  'activeKey={selectedGlobalPermissionRole}',
  'items={globalRoles.map(role => ({ key: role.name, label: role.name }))}',
  'GLOBAL_PERMISSION_GROUPS.map(group => (',
  'maxGlobalPermissionColumns',
]) {
  assertIncludes(moduleSource, text, 'global permission role-tab layout')
}

console.log('Global permission matrix is aligned with the required table.')
