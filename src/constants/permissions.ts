export const FIXED_ROLES = ['系统管理员', '项目经理', '产品经理', '软件SE', '开发代表', '设计师', '测试TPM', 'SQA', '开发工程师', '测试工程师', '管理层', '其他']

export const ALL_USERS = ['张三', '李四', '王五', '赵六', '孙七', '周八', '李白', '杜甫']

export interface ProjectPermissionItem {
  key: string
  name: string
  aliases?: string[]
}

export const PROJECT_PERMISSION_GROUPS: { module: string; permissions: ProjectPermissionItem[] }[] = [
  {
    module: '基础信息',
    permissions: [
      { key: 'basicInfo:查看', name: '基本信息-查看' },
      { key: 'basicInfo:transferView', name: '转维信息-查看' },
      { key: 'basicInfo:planConfigView', name: '计划与配置-查看' },
      { key: 'basicInfo:编辑', name: '基础信息-编辑' },
      { key: 'basicInfo:applyTransfer', name: '申请转维' },
    ],
  },
  {
    module: '一级计划',
    permissions: [
      { key: 'plan:一级计划-编辑', name: '编辑', aliases: ['plan:二级计划-编辑'] },
      { key: 'plan:一级计划-查看', name: '查看', aliases: ['plan:二级计划-查看'] },
      { key: 'plan:一级计划-分享', name: '分享' },
      { key: 'plan:导入', name: '导入' },
      { key: 'plan:导出', name: '导出' },
    ],
  },
  {
    module: '权限中心',
    permissions: [
      { key: 'projectPermission:manageRoles', name: '对角色进行新增、修改、删除、成员添加' },
    ],
  },
]

export const PROJECT_PERMISSION_ITEMS = PROJECT_PERMISSION_GROUPS.flatMap(group => group.permissions)

export const getProjectPermissionKeys = (permission: ProjectPermissionItem): string[] => [
  permission.key,
  ...(permission.aliases ?? []),
]

export const GLOBAL_PERMISSION_GROUPS = [
  {
    module: '项目路标',
    permissions: [
      { key: 'roadmap:view', name: '查看' },
      { key: 'roadmap:edit', name: '编辑' },
      { key: 'roadmap:baseline', name: '基线' },
      { key: 'roadmap:share', name: '分享' },
      { key: 'roadmap:export', name: '导出' },
    ],
  },
  {
    module: '配置中心',
    permissions: [
      { key: 'configCenter:planEdit', name: '计划编辑' },
      { key: 'configCenter:planPublish', name: '计划发布' },
      { key: 'configCenter:transferEdit', name: '转维编辑' },
      { key: 'configCenter:enumEdit', name: '枚举值新增、修改、删除' },
    ],
  },
  {
    module: '权限中心',
    permissions: [
      { key: 'permissionCenter:manageRoles', name: '对角色进行新增、修改、删除、成员添加' },
    ],
  },
]

export const GLOBAL_PERM_OPTIONS = GLOBAL_PERMISSION_GROUPS.flatMap(group =>
  group.permissions.map(permission => ({ ...permission, module: group.module }))
)
