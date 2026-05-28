import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const permissionModuleFile = path.join(root, 'src/components/permission/PermissionModule.tsx')
const permissionConstantsFile = path.join(root, 'src/constants/permissions.ts')
const permissionStoreFile = path.join(root, 'src/stores/permission.ts')

const expectedRoles = [
  '系统管理员',
  '项目经理',
  '产品经理',
  '软件SE',
  '开发代表',
  '设计师',
  '测试TPM',
  'SQA',
  '开发工程师',
  '测试工程师',
  '管理层',
  '其他',
]

const expectedPermissions = [
  { key: 'basicInfo:查看', label: '基本信息-查看' },
  { key: 'basicInfo:transferView', label: '转维信息-查看' },
  { key: 'basicInfo:planConfigView', label: '计划与配置-查看' },
  { key: 'basicInfo:编辑', label: '基础信息-编辑' },
  { key: 'basicInfo:applyTransfer', label: '申请转维' },
  { key: 'plan:一级计划-编辑', label: '编辑' },
  { key: 'plan:一级计划-查看', label: '查看' },
  { key: 'plan:一级计划-分享', label: '分享' },
  { key: 'plan:导入', label: '导入' },
  { key: 'plan:导出', label: '导出' },
  { key: 'projectPermission:manageRoles', label: '对角色进行新增、修改、删除、成员添加' },
]

const basicReadOnly = ['basicInfo:查看', 'basicInfo:transferView']
const readPlanExport = [
  'basicInfo:查看',
  'basicInfo:transferView',
  'basicInfo:planConfigView',
  'plan:一级计划-查看',
  'plan:一级计划-分享',
  'plan:导出',
]

const expectedByRole = {
  '系统管理员': expectedPermissions.map(p => p.key),
  '项目经理': expectedPermissions.map(p => p.key),
  '产品经理': basicReadOnly,
  '软件SE': basicReadOnly,
  '开发代表': readPlanExport,
  '设计师': basicReadOnly,
  '测试TPM': readPlanExport,
  'SQA': readPlanExport,
  '开发工程师': basicReadOnly,
  '测试工程师': basicReadOnly,
  '管理层': readPlanExport,
  '其他': basicReadOnly,
}

function fail(message) {
  console.error(message)
  process.exit(1)
}

function assertIncludes(source, text, label) {
  if (!source.includes(text)) fail(`${label} is missing ${text}`)
}

function readRequiredFile(file) {
  if (!fs.existsSync(file)) fail(`Missing ${path.relative(root, file)}`)
  return fs.readFileSync(file, 'utf8')
}

function extractArrayBlock(source, declarationName) {
  const start = source.indexOf(`const ${declarationName}`)
  if (start === -1) return ''
  const open = source.indexOf('[', start)
  const close = source.indexOf(']', open)
  if (open === -1 || close === -1) return ''
  return source.slice(open, close + 1)
}

function extractRoleBlock(source, role) {
  const start = source.indexOf(`'${role}': [`)
  if (start === -1) return ''
  const close = source.indexOf(']', start)
  if (close === -1) return ''
  return source.slice(start, close + 1)
}

const moduleSource = readRequiredFile(permissionModuleFile)
const constantsSource = readRequiredFile(permissionConstantsFile)
const storeSource = readRequiredFile(permissionStoreFile)

assertIncludes(constantsSource, 'PROJECT_PERMISSION_GROUPS', 'project permission matrix config')
for (const groupLabel of ['基础信息', '一级计划', '权限中心']) {
  assertIncludes(constantsSource, groupLabel, 'project permission table')
}

const fixedRolesBlock = extractArrayBlock(constantsSource, 'FIXED_ROLES')
if (!fixedRolesBlock) fail('Could not find FIXED_ROLES array')
for (const role of expectedRoles) {
  assertIncludes(fixedRolesBlock, `'${role}'`, 'FIXED_ROLES')
}

for (const { key, label } of expectedPermissions) {
  assertIncludes(constantsSource, key, 'PROJECT_PERMISSION_GROUPS')
  assertIncludes(constantsSource, label, 'PROJECT_PERMISSION_GROUPS')
}

for (const text of [
  '角色权限配置',
  'activeKey={selectedPermissionRole}',
  'items={roles.map(role => ({ key: role.name, label: role.name }))}',
  'PROJECT_PERMISSION_GROUPS.map(group => (',
  'colSpan={maxProjectPermissionColumns - group.permissions.length + 1}',
]) {
  assertIncludes(moduleSource, text, 'project permission role-tab layout')
}

for (const [role, enabledKeys] of Object.entries(expectedByRole)) {
  const roleBlock = extractRoleBlock(storeSource, role)
  if (!roleBlock) fail(`Missing PROJECT_PERMISSION_PRESETS for ${role}`)
  for (const { key } of expectedPermissions) {
    const shouldEnable = enabledKeys.includes(key)
    const hasKey = roleBlock.includes(`'${key}'`)
    if (shouldEnable && !hasKey) fail(`${role} should enable ${key}`)
    if (!shouldEnable && hasKey) fail(`${role} should not enable ${key}`)
  }
}

console.log('Project-space permission matrix is aligned with the required table.')
